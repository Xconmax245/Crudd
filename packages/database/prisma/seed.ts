import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Question Banks...')

  // Clean up existing (only safe because of cascade)
  await prisma.questionBank.deleteMany({})

  // 1. General Knowledge Bank
  const generalBank = await prisma.questionBank.create({
    data: {
      title: 'General Knowledge',
      subject: 'Mixed',
      category: 'Trivia',
      description: 'A broad mix of trivia across history, geography, science and culture.',
      tags: ['trivia', 'mixed', 'general'],
      status: 'PUBLISHED',
      publishedAt: new Date(),
      questionCount: 20,

      questions: {
        create: [
          { questionText: "What is the capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], correctIndex: 2 },
          { questionText: "Who wrote 'Romeo and Juliet'?", options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], correctIndex: 1 },
          { questionText: "What is the largest planet in our solar system?", options: ["Earth", "Mars", "Jupiter", "Saturn"], correctIndex: 2 },
          { questionText: "Which element has the chemical symbol 'O'?", options: ["Gold", "Oxygen", "Osmium", "Oganesson"], correctIndex: 1 },
          { questionText: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], correctIndex: 2 },
          { questionText: "What is the hardest natural substance on Earth?", options: ["Gold", "Iron", "Diamond", "Platinum"], correctIndex: 2 },
          { questionText: "In which year did the Titanic sink?", options: ["1910", "1912", "1915", "1920"], correctIndex: 1 },
          { questionText: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3 },
          { questionText: "What is the smallest country in the world?", options: ["Monaco", "Nauru", "Vatican City", "San Marino"], correctIndex: 2 },
          { questionText: "Who painted the Mona Lisa?", options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Claude Monet"], correctIndex: 2 },
          { questionText: "What is the currency of Japan?", options: ["Yen", "Won", "Yuan", "Ringgit"], correctIndex: 0 },
          { questionText: "Which language has the most native speakers?", options: ["English", "Spanish", "Hindi", "Mandarin Chinese"], correctIndex: 3 },
          { questionText: "What is the main ingredient in guacamole?", options: ["Tomato", "Avocado", "Onion", "Lime"], correctIndex: 1 },
          { questionText: "Who was the first person to walk on the moon?", options: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"], correctIndex: 2 },
          { questionText: "What is the longest river in the world?", options: ["Amazon", "Nile", "Yangtze", "Mississippi"], correctIndex: 1 },
          { questionText: "Which animal is known as the 'King of the Jungle'?", options: ["Tiger", "Lion", "Elephant", "Gorilla"], correctIndex: 1 },
          { questionText: "What is the chemical formula for water?", options: ["CO2", "H2O", "O2", "NaCl"], correctIndex: 1 },
          { questionText: "Who discovered penicillin?", options: ["Marie Curie", "Alexander Fleming", "Louis Pasteur", "Isaac Newton"], correctIndex: 1 },
          { questionText: "What is the capital of France?", options: ["Rome", "Berlin", "Paris", "Madrid"], correctIndex: 2 },
          { questionText: "How many legs does a spider have?", options: ["6", "8", "10", "12"], correctIndex: 1 },
        ],
      },
    },
  })

  // 2. Human Biology Bank
  const biologyBank = await prisma.questionBank.create({
    data: {
      title: 'Human Biology',
      subject: 'Science',
      category: 'Science',
      description: 'Core facts about human anatomy, physiology and cell biology.',
      tags: ['science', 'biology', 'anatomy'],
      status: 'PUBLISHED',
      publishedAt: new Date(),
      questionCount: 15,

      questions: {
        create: [
          { questionText: "Which organ is responsible for pumping blood throughout the body?", options: ["Lungs", "Brain", "Heart", "Liver"], correctIndex: 2 },
          { questionText: "What is the largest organ of the human body?", options: ["Skin", "Liver", "Large Intestine", "Brain"], correctIndex: 0 },
          { questionText: "How many bones are in the adult human body?", options: ["206", "210", "198", "212"], correctIndex: 0 },
          { questionText: "What is the main function of red blood cells?", options: ["Fight infection", "Carry oxygen", "Clot blood", "Produce hormones"], correctIndex: 1 },
          { questionText: "Which part of the brain controls balance and coordination?", options: ["Cerebrum", "Cerebellum", "Brainstem", "Hypothalamus"], correctIndex: 1 },
          { questionText: "What is the shape of DNA?", options: ["Single helix", "Double helix", "Triple helix", "Quadruple helix"], correctIndex: 1 },
          { questionText: "Which vitamin is primarily produced by the skin when exposed to sunlight?", options: ["Vitamin A", "Vitamin B12", "Vitamin C", "Vitamin D"], correctIndex: 3 },
          { questionText: "What is the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi apparatus"], correctIndex: 2 },
          { questionText: "Which organ produces insulin?", options: ["Liver", "Pancreas", "Kidneys", "Stomach"], correctIndex: 1 },
          { questionText: "What type of joint is the human shoulder?", options: ["Hinge joint", "Pivot joint", "Ball-and-socket joint", "Saddle joint"], correctIndex: 2 },
          { questionText: "What is the name of the longest bone in the human body?", options: ["Tibia", "Fibula", "Femur", "Humerus"], correctIndex: 2 },
          { questionText: "Which blood type is considered the universal donor?", options: ["A positive", "B negative", "AB positive", "O negative"], correctIndex: 3 },
          { questionText: "What is the medical term for the windpipe?", options: ["Esophagus", "Trachea", "Bronchus", "Pharynx"], correctIndex: 1 },
          { questionText: "Which part of the eye gives it its color?", options: ["Pupil", "Cornea", "Iris", "Retina"], correctIndex: 2 },
          { questionText: "What is the primary gas found in human breath when exhaling?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], correctIndex: 2 },
        ],
      },
    },
  })

  // Publish all seeded questions so they are eligible for public challenge generation.
  const published = await prisma.question.updateMany({
    where: { bankId: { in: [generalBank.id, biologyBank.id] } },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  })

  console.log(`Created Bank: ${generalBank.title} (${generalBank.questionCount} questions)`)
  console.log(`Created Bank: ${biologyBank.title} (${biologyBank.questionCount} questions)`)
  console.log(`Published ${published.count} questions across seeded banks.`)
  console.log('Seeding Complete!')

}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
