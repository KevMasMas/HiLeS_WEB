-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HilesElementType" AS ENUM ('STRUCTURAL_BLOCK', 'FUNCTIONAL_BLOCK', 'SERVICE', 'PORT', 'SAMPLE', 'HOLD', 'PLACE', 'TRANSITION');

-- CreateEnum
CREATE TYPE "HilesConnectionType" AS ENUM ('CONTINUOUS', 'DISCRETE', 'PETRI');

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HilesModel" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HilesModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HilesElement" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "parentElementId" UUID,
    "type" "HilesElementType" NOT NULL,
    "name" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "rotation" DOUBLE PRECISION,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HilesElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HilesConnection" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "sourceElementId" UUID NOT NULL,
    "targetElementId" UUID NOT NULL,
    "type" "HilesConnectionType" NOT NULL,
    "sourceHandle" TEXT,
    "targetHandle" TEXT,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HilesConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HilesModel_projectId_idx" ON "HilesModel"("projectId");

-- CreateIndex
CREATE INDEX "HilesElement_modelId_idx" ON "HilesElement"("modelId");

-- CreateIndex
CREATE INDEX "HilesElement_parentElementId_idx" ON "HilesElement"("parentElementId");

-- CreateIndex
CREATE INDEX "HilesConnection_modelId_idx" ON "HilesConnection"("modelId");

-- CreateIndex
CREATE INDEX "HilesConnection_sourceElementId_idx" ON "HilesConnection"("sourceElementId");

-- CreateIndex
CREATE INDEX "HilesConnection_targetElementId_idx" ON "HilesConnection"("targetElementId");

-- AddForeignKey
ALTER TABLE "HilesModel" ADD CONSTRAINT "HilesModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HilesElement" ADD CONSTRAINT "HilesElement_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "HilesModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HilesElement" ADD CONSTRAINT "HilesElement_parentElementId_fkey" FOREIGN KEY ("parentElementId") REFERENCES "HilesElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HilesConnection" ADD CONSTRAINT "HilesConnection_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "HilesModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HilesConnection" ADD CONSTRAINT "HilesConnection_sourceElementId_fkey" FOREIGN KEY ("sourceElementId") REFERENCES "HilesElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HilesConnection" ADD CONSTRAINT "HilesConnection_targetElementId_fkey" FOREIGN KEY ("targetElementId") REFERENCES "HilesElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
