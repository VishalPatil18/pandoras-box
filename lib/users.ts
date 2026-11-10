import "server-only";
import { prisma } from "@/lib/db";

// Callers pass a title already normalized by MovieTitleSchema.
export async function setFavoriteMovie(userId: string, movie: string): Promise<string> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { favoriteMovie: movie },
    select: { favoriteMovie: true },
  });
  return user.favoriteMovie ?? movie;
}
