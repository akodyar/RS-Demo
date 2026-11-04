const fs = require('fs');

let apiContent = fs.readFileSync('src/server/routes/api.ts', 'utf8');

if (!apiContent.includes('authRouter')) {
  apiContent = apiContent.replace("import propertiesRouter from './properties';", "import authRouter from './auth.js';\nimport propertiesRouter from './properties.js';");
  apiContent = apiContent.replace("apiRouter.use('/properties', propertiesRouter);", "apiRouter.use('/auth', authRouter);\napiRouter.use('/properties', propertiesRouter);");
  fs.writeFileSync('src/server/routes/api.ts', apiContent);
}
