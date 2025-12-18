-- CreateTable
CREATE TABLE "KeepAliveCursor" (
    "id" TEXT NOT NULL,
    "lastKeepAliveThreadId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeepAliveCursor_pkey" PRIMARY KEY ("id")
);
