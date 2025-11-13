-- CreateTable
CREATE TABLE "Situation" (
    "identifier" TEXT NOT NULL,
    "descriptions" JSONB NOT NULL,
    "imageLink" TEXT,
    "targetLanguage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Situation_pkey" PRIMARY KEY ("identifier")
);

-- CreateTable
CREATE TABLE "Gloss" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isParaphrased" BOOLEAN NOT NULL DEFAULT false,
    "transcriptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gloss_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "_GlossClarifiesUsage" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GlossClarifiesUsage_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_GlossDifferentiations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GlossDifferentiations_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ExpressionChallenges" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExpressionChallenges_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_UnderstandingChallenges" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UnderstandingChallenges_AB_pkey" PRIMARY KEY ("A","B")
);

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
CREATE INDEX "_GlossClarifiesUsage_B_index" ON "_GlossClarifiesUsage"("B");

-- CreateIndex
CREATE INDEX "_GlossDifferentiations_B_index" ON "_GlossDifferentiations"("B");

-- CreateIndex
CREATE INDEX "_ExpressionChallenges_B_index" ON "_ExpressionChallenges"("B");

-- CreateIndex
CREATE INDEX "_UnderstandingChallenges_B_index" ON "_UnderstandingChallenges"("B");

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
ALTER TABLE "_GlossClarifiesUsage" ADD CONSTRAINT "_GlossClarifiesUsage_A_fkey" FOREIGN KEY ("A") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossClarifiesUsage" ADD CONSTRAINT "_GlossClarifiesUsage_B_fkey" FOREIGN KEY ("B") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossDifferentiations" ADD CONSTRAINT "_GlossDifferentiations_A_fkey" FOREIGN KEY ("A") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GlossDifferentiations" ADD CONSTRAINT "_GlossDifferentiations_B_fkey" FOREIGN KEY ("B") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpressionChallenges" ADD CONSTRAINT "_ExpressionChallenges_A_fkey" FOREIGN KEY ("A") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExpressionChallenges" ADD CONSTRAINT "_ExpressionChallenges_B_fkey" FOREIGN KEY ("B") REFERENCES "Situation"("identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnderstandingChallenges" ADD CONSTRAINT "_UnderstandingChallenges_A_fkey" FOREIGN KEY ("A") REFERENCES "Gloss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UnderstandingChallenges" ADD CONSTRAINT "_UnderstandingChallenges_B_fkey" FOREIGN KEY ("B") REFERENCES "Situation"("identifier") ON DELETE CASCADE ON UPDATE CASCADE;
