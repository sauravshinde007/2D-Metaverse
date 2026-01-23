// server/config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

const configurePassport = () => {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: "/api/auth/google/callback"
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Check if user already exists
                    let user = await User.findOne({ googleId: profile.id });

                    if (user) {
                        return done(null, user);
                    }

                    // Check if user exists with the same email (if so, link accounts or error)
                    // Ideally, we link them. For now, let's just find by email.
                    const email = profile.emails[0].value;
                    let existingEmailUser = await User.findOne({ email });

                    if (existingEmailUser) {
                        // Link - add googleId to existing user
                        existingEmailUser.googleId = profile.id;
                        existingEmailUser.avatar = profile.photos[0]?.value || "";
                        await existingEmailUser.save();
                        return done(null, existingEmailUser);
                    }

                    // Create new user
                    const newUser = await User.create({
                        username: profile.displayName.replace(/\s+/g, '_').toLowerCase() + "_" + Math.floor(Math.random() * 1000), // Generate unique username
                        email: email,
                        googleId: profile.id,
                        avatar: profile.photos[0]?.value || "",
                        // Password is not required due to our schema change, but we can set a dummy one if needed
                        // password: ...
                    });

                    done(null, newUser);
                } catch (error) {
                    done(error, null);
                }
            }
        )
    );

    // We are not using sessions (JWT based), so serialization might not be strictly needed if we handle token generation in the callback route controller manually.
    // But passport usually expects serialize/deserialize if using session: true (default).
    // We will likely set session: false in the route.
};

export default configurePassport;
