When you modify some code just run `pnpm build_and_publish`. That's all.

It will publish a new package to cloud, and also handle git

If you get `401 User cannot be authenticated with the token provided.` Most likely your github token expired. In that case:

1. Go to https://github.com/settings/tokens and click on regenarete that token.
2. Run `npm login --registry=https://npm.pkg.github.com`. And user `dvagala` as username and that new token as password
