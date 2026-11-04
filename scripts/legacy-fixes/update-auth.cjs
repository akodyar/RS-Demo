const fs = require('fs');

let authContent = fs.readFileSync('src/server/middleware/auth.ts', 'utf8');

const importStatements = `
import { firebaseAdmin } from '../config/firebase.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
`;

authContent = authContent.replace("import { eq, and } from 'drizzle-orm';", "import { eq, and } from 'drizzle-orm';\n" + importStatements);

const requireAuthImplementation = `
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid credentials' });
  }

  const token = authHeader.split('Bearer ')[1];
  
  try {
    if (!firebaseAdmin) {
      // If no firebase connection configured in env, we fail securely in production,
      // but if we are testing locally without credentials, we might need a bypass OR we just fail.
      // Requirements state: "Reject invalid, expired, malformed, missing, or revoked authentication"
      throw new Error("Identity Provider NOT_CONFIGURED");
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token, true);
    
    (req as any).firebaseUser = decodedToken;
    
    // Look up the application user
    const dbUsers = await db.select().from(users).where(eq(users.uid, decodedToken.uid)).limit(1);
    
    if (dbUsers.length > 0) {
      req.user = dbUsers[0] as any;
      
      if (!req.user?.isActive) {
        return res.status(403).json({ error: 'Forbidden: Account suspended' });
      }
    }
    
    next();
  } catch (error: any) {
    console.error("Auth error:", error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
`;

authContent = authContent.replace(/export const requireAuth = \([\s\S]*?next\(\);\n};/, requireAuthImplementation);

// Add typings for req.user and req.firebaseUser
const typings = `
declare module 'express-serve-static-core' {
  interface Request {
    user?: any;
    firebaseUser?: any;
  }
}
`;

fs.writeFileSync('src/server/middleware/auth.ts', typings + authContent);
