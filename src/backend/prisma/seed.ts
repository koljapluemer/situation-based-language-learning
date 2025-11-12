import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hello = await prisma.gloss.upsert({
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

  const question = await prisma.gloss.upsert({
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
        connect: [{ id: hello.id }],
      },
    },
  });

  await prisma.situation.upsert({
    where: { identifier: "greeting-basic" },
    update: {},
    create: {
      identifier: "greeting-basic",
      descriptions: [
        { language: "spa", content: "Primeros saludos" },
        { language: "deu", content: "Erste Grüße" },
      ],
      challengesOfExpression: {
        create: [
          {
            identifier: "saluda-a-un-amigo",
            prompts: [
              { language: "eng", content: "Greet a friend" },
              { language: "spa", content: "Saluda a un amigo" },
            ],
            glosses: { connect: [{ id: hello.id }, { id: question.id }] },
          },
        ],
      },
      challengesOfUnderstanding: {
        create: [
          {
            text: "Hola, ¿cómo estás?",
            language: "spa",
            glosses: { connect: [{ id: hello.id }, { id: question.id }] },
          },
        ],
      },
    },
  });
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
