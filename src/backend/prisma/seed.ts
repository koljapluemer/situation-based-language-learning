import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create Spanish glosses for understanding challenges (target language)
  const hola = await prisma.gloss.upsert({
    where: {
      language_content: {
        language: "spa",
        content: "hola",
      },
    },
    update: {},
    create: {
      language: "spa",
      content: "hola",
      isParaphrased: false,
      transcriptions: ["ˈola"],
      notes: [
        {
          noteType: "usage",
          content: "Used for informal greetings",
          showBeforeSolution: true,
        },
      ],
    },
  });

  const comoEstas = await prisma.gloss.upsert({
    where: {
      language_content: {
        language: "spa",
        content: "¿Cómo estás?",
      },
    },
    update: {},
    create: {
      language: "spa",
      content: "¿Cómo estás?",
      isParaphrased: false,
      transcriptions: ["ˈkomo esˈtas"],
      contains: {
        connect: [{ id: hola.id }],
      },
    },
  });

  // Create English glosses for expression challenges (native language prompts)
  const greetFriend = await prisma.gloss.upsert({
    where: {
      language_content: {
        language: "eng",
        content: "Greet a friend",
      },
    },
    update: {},
    create: {
      language: "eng",
      content: "Greet a friend",
      isParaphrased: false,
      notes: [
        {
          noteType: "usage",
          content: "A casual, friendly greeting",
          showBeforeSolution: true,
        },
      ],
    },
  });

  const askHowAreYou = await prisma.gloss.upsert({
    where: {
      language_content: {
        language: "eng",
        content: "Ask how someone is doing",
      },
    },
    update: {},
    create: {
      language: "eng",
      content: "Ask how someone is doing",
      isParaphrased: false,
    },
  });

  // Create situation with direct gloss connections
  await prisma.situation.upsert({
    where: { id: "greeting-basic" },
    update: {},
    create: {
      id: "greeting-basic",
      descriptions: [
        { language: "eng", content: "Basic greetings" },
        { language: "spa", content: "Primeros saludos" },
        { language: "deu", content: "Erste Grüße" },
      ],
      targetLanguage: "spa",
      nativeLanguage: "eng",
      challengesOfExpression: {
        connect: [{ id: greetFriend.id }, { id: askHowAreYou.id }],
      },
      challengesOfUnderstandingText: {
        connect: [{ id: hola.id }, { id: comoEstas.id }],
      },
    },
  });

  console.log("Seed data created successfully");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
