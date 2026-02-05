const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const pipelineCount = await prisma.pipeline.count();
  if (pipelineCount > 0) {
    return;
  }

  await prisma.pipeline.create({
    data: {
      name: "세일즈 파이프라인",
      position: 0,
      stages: {
        create: [
          {
            name: "제안",
            probability: 30,
            description: "제안서를 전달하고 협의를 시작한 단계",
            stagnationDays: 14,
            position: 0,
          },
          {
            name: "수주",
            probability: 100,
            description: "계약이 확정된 단계",
            stagnationDays: 0,
            position: 1,
          },
          {
            name: "실패",
            probability: 0,
            description: "딜이 종료된 단계",
            stagnationDays: 0,
            position: 2,
          },
        ],
      },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
