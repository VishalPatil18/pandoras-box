import { SetMovieBodySchema, type SetMovieResponse } from "@/lib/contracts";
import { parseBody, withUser } from "@/lib/http";
import { setFavoriteMovie } from "@/lib/users";

export const PUT = withUser(async (user, request): Promise<SetMovieResponse> => {
  const { movie } = await parseBody(request, SetMovieBodySchema);
  return { favoriteMovie: await setFavoriteMovie(user.id, movie) };
});
