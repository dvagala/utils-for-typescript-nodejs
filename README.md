When you modify some code just run `pnpm build_and_publish`. That's all.

It will publish a new package to cloud, and also handle git

But the projects that use this utils need to run `pnpm update @dvagala/utils` to pull new version.

If you get `401 User cannot be authenticated with the token provided.` Most likely your github token expired. In that case:

1. Go to https://github.com/settings/tokens and click on regenarete that token.
2. Run `npm login --registry=https://npm.pkg.github.com`. And user `dvagala` as username and that new token as password
3. Go to all projects that use this utils and to their .npmrc add new token
   so for hapsy that means in my macbook, but also on server
