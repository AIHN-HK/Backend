import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';

type AdminEnv = Partial<
  Record<
    | 'BOOTSTRAP_ADMIN_EMAIL'
    | 'BOOTSTRAP_ADMIN_PASSWORD'
    | 'BOOTSTRAP_ADMIN_FULLNAME'
    | 'BOOTSTRAP_ADMIN_YOB',
    string
  >
>;

export async function bootstrapAdmin(
  prisma: Pick<PrismaClient, 'user'>,
  env: AdminEnv,
) {
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  const fullname = env.BOOTSTRAP_ADMIN_FULLNAME?.trim();
  const date = env.BOOTSTRAP_ADMIN_YOB;
  const yob = date ? new Date(`${date}T00:00:00.000Z`) : new Date(NaN);
  if (
    !email ||
    !isEmail(email) ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 72 ||
    !fullname ||
    fullname.length > 120 ||
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(yob.getTime()) ||
    yob.toISOString().slice(0, 10) !== date ||
    yob > new Date()
  ) {
    throw new Error(
      'Invalid bootstrap config: email, password (12+ characters, <=72 UTF-8 bytes), fullname and valid YYYY-MM-DD birth date required',
    );
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'ADMIN')
      throw new Error(
        'Account already exists without ADMIN role; refusing promotion',
      );
    return { created: false, id: existing.id };
  }
  try {
    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        fullname,
        yob,
        role: 'ADMIN',
      },
      select: { id: true },
    });
    return { created: true, id: user.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const winner = await prisma.user.findUnique({ where: { email } });
      if (winner?.role === 'ADMIN') return { created: false, id: winner.id };
    }
    throw new Error(
      'Admin creation failed; inspect database state before retrying',
    );
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  bootstrapAdmin(prisma, {
    BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    BOOTSTRAP_ADMIN_FULLNAME: process.env.BOOTSTRAP_ADMIN_FULLNAME,
    BOOTSTRAP_ADMIN_YOB: process.env.BOOTSTRAP_ADMIN_YOB,
  })
    .then((result) =>
      console.log(
        result.created
          ? `ADMIN created (id=${result.id})`
          : `ADMIN already exists (id=${result.id}); unchanged`,
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
