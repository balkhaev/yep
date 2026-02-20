import { PrismaLibSql } from "@prisma/adapter-libsql";
import { env } from "@yep/env/server";

import { PrismaClient } from "../prisma/generated/client";

const adapter = new PrismaLibSql({
	url: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
