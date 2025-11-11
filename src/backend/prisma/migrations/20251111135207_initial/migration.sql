-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('deu', 'arz', 'arb', 'apc', 'cmn', 'fra', 'spa', 'uzb');

-- CreateTable
CREATE TABLE "Situation" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "descriptions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Situation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gloss" (
    "id" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "content" TEXT NOT NULL,
    "isParaphrased" BOOLEAN NOT NULL DEFAULT false,
    "transcriptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gloss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeOfExpression" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "situationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeOfExpression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeOfUnderstandingText" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" "LanguageCode" NOT NULL,
    "situationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeOfUnderstandingText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GlossContains" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GlossContains_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GlossNearSynonyms" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GlossNearSynonyms_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GlossNearHomophones" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GlossNearHomophones_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GlossTranslations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GlossTranslations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ExpressionGlosses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExpressionGlosses_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_UnderstandingGlosses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UnderstandingGlosses_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Situation_identifier_key" ON "Situation"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Gloss_language_content_key" ON "Gloss"("language", "content");

-- CreateIndex
CREATE INDEX "_GlossContains_B_index" ON "_GlossContains"("B");

-- CreateIndex
CREATE INDEX "_GlossNearSynonyms_B_index" ON "_GlossNearSynonyms"("B");

-- CreateIndex
CREATE INDEX "_GlossNearHomophones_B_index" ON "_GlossNearHomophones"("B");

-- CreateIndex
CREATE INDEX "_GlossTranslations_B_index" ON "_GlossTranslations"("B");

-- CreateIndex
CREATE INDEX "_ExpressionGlosses_B_index" ON "_ExpressionGlosses"("B");

-- CreateIndex
CREATE INDEX "_UnderstandingGlosses_B_index" ON "_UnderstandingGlosses"("B");

-- AddForeignKey
ALTER TABLE "ChallengeOfExpression" ADD CONSTRAINT "ChallengeOfExpression_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "Situation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeOfUnderstandingText" ADD CONSTRAINT "ChallengeOfUnderstandingText_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "Situation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossContains" ADD CONSTRAINT "_GlossContains_A_fkey" FOREIGN KEY ("A") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossContains" ADD CONSTRAINT "_GlossContains_B_fkey" FOREIGN KEY ("B") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossNearSynonyms" ADD CONSTRAINT "_GlossNearSynonyms_A_fkey" FOREIGN KEY ("A") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossNearSynonyms" ADD CONSTRAINT "_GlossNearSynonyms_B_fkey" FOREIGN KEY ("B") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossNearHomophones" ADD CONSTRAINT "_GlossNearHomophones_A_fkey" FOREIGN KEY ("A") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossNearHomophones" ADD CONSTRAINT "_GlossNearHomophones_B_fkey" FOREIGN KEY ("B") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossTranslations" ADD CONSTRAINT "_GlossTranslations_A_fkey" FOREIGN KEY ("A") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossTranslations" ADD CONSTRAINT "_GlossTranslations_B_fkey" FOREIGN KEY ("B") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpressionGlosses" ADD CONSTRAINT "_ExpressionGlosses_A_fkey" FOREIGN KEY ("A") REFERENCES "ChallengeOfExpression"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpressionGlosses" ADD CONSTRAINT "_ExpressionGlosses_B_fkey" FOREIGN KEY ("B") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnderstandingGlosses" ADD CONSTRAINT "_UnderstandingGlosses_A_fkey" FOREIGN KEY ("A") REFERENCES "ChallengeOfUnderstandingText"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnderstandingGlosses" ADD CONSTRAINT "_UnderstandingGlosses_B_fkey" FOREIGN KEY ("B") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;
