import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { MatchEngineApi } from '../hooks/useMatchEngine';

export function ChatPanel({ engine }: { engine: MatchEngineApi }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { chatMessages, sendChatMessage, sessionId } = engine;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (draft.trim().length > 200) return;
    
    sendChatMessage(draft.trim());
    setDraft('');
  };

  const charsRemaining = 200 - draft.length;

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-pink text-ink p-4 rounded-full border-3 border-ink shadow-[4px_4px_0px_#0A0A0A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#0A0A0A] transition-all"
        aria-label="Open chat"
      >
        <MessageCircle size={28} />
        {chatMessages.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-yellow text-ink text-xs font-black w-6 h-6 rounded-full border-2 border-ink flex items-center justify-center">
            {chatMessages.length}
          </span>
        )}
      </button>

      {/* Chat Drawer/Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-80 md:w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] z-50 flex flex-col bg-cream border-3 border-ink rounded-crudd shadow-[8px_8px_0px_#0A0A0A] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-cyan p-4 border-b-3 border-ink flex justify-between items-center shrink-0">
              <h2 className="font-display font-black text-xl">Match Chat</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-ink/10 p-1 rounded-crudd transition-colors"
                aria-label="Close chat"
              >
                <X size={24} />
              </button>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/50">
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-ink/40 font-bold text-center italic">
                  No messages yet.<br/>Be the first to say hi!
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isMine = msg.sessionId === sessionId;
                  return (
                    <div
                      key={`${msg.timestamp}-${i}`}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-xs font-bold opacity-50 mb-1 px-1">
                        {msg.username}
                      </span>
                      <div
                        className={`max-w-[85%] px-4 py-2 rounded-crudd border-2 border-ink font-medium break-words ${
                          isMine
                            ? 'bg-lime rounded-br-sm'
                            : 'bg-white rounded-bl-sm'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form
              onSubmit={handleSubmit}
              className="p-4 bg-cream border-t-3 border-ink shrink-0"
            >
              <div className="relative">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={200}
                  placeholder="Say something..."
                  className="w-full bg-white border-2 border-ink rounded-crudd pl-4 pr-12 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-cyan"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || draft.trim().length > 200}
                  className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-purple text-cream rounded-crudd hover:bg-ink disabled:opacity-50 disabled:hover:bg-purple transition-colors border-2 border-ink shadow-[2px_2px_0px_#0A0A0A]"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="mt-2 text-right">
                <span className={`text-xs font-bold ${charsRemaining < 20 ? 'text-red-500' : 'opacity-50'}`}>
                  {charsRemaining} / 200
                </span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
