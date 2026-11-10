import type { Me } from "@/lib/contracts";
import { withUser } from "@/lib/http";

export const GET = withUser(async (user): Promise<Me> => user);
