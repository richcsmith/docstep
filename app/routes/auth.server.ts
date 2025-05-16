import { User } from "@prisma/client";
import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import { prisma } from "./services/prisma.server";
import { sessionStorage } from "./services/session.server";

export const authenticator = new Authenticator<User>(sessionStorage);

const googleStrategy = new GoogleStrategy<User>(
  {
    clientID: process.env.GOOGLE_CLIENT_ID_DEVELOPMENT as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET_DEVELOPMENT as string,
    callbackURL: process.env.GOOGLE_CALLBACK_URL_DEVELOPMENT as string,
  },
  async ({ accessToken, refreshToken, profile, request }) => {
    let user: User | null = await prisma.user.findUnique({
      where: { email: profile._json.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          email: profile._json.email,
        },
      });
    }

    const session = await sessionStorage.getSession(
      request.headers.get("cookie")
    );

    session.set(authenticator.sessionKey, {
      ...user,
      accessToken,
      refreshToken,
    });

    await sessionStorage.commitSession(session);
    return user;
  }
);

authenticator.use(googleStrategy);
