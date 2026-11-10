import type { FactResponse } from "@/lib/contracts";
import { getFact } from "@/lib/facts";
import { withUser } from "@/lib/http";

// Room for a waiter to sit out the holder's 8 second OpenAI call.
export const maxDuration = 15;

export const GET = withUser(async (user): Promise<FactResponse> => getFact(user.id));
