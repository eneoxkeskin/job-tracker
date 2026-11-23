// The only route handler in the app: Auth.js needs it for the OAuth redirect and callback.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
