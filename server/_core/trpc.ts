import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;

const requireAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
const isOwner = (role: string) => role === "owner";
const isOperator = (role: string) => isOwner(role) || role === "operator";

export const operatorProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    if (!isOperator(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Your account is awaiting owner authorization." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
export const ownerProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user || !isOwner(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

// Keep starter imports working, but require owner authority for every admin action.
export const protectedProcedure = t.procedure.use(requireAuthenticated);
export const adminProcedure = ownerProcedure;
