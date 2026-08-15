# GitHub CI failure — 2026-08-15

Repository: https://github.com/tidclibya2026/tidcatlas.ly
Pull Request: https://github.com/tidclibya2026/tidcatlas.ly/pull/2
Workflow run: https://github.com/tidclibya2026/tidcatlas.ly/actions/runs/31898335358
Job: https://github.com/tidclibya2026/tidcatlas.ly/actions/runs/31898335358/job/95045002457?pr=2

The pnpm conflict is fixed. GitHub successfully ran `pnpm/action-setup@v4`, `pnpm install --frozen-lockfile`, and `pnpm check`.

The job failed in `pnpm test` after 58 seconds. The failing test is `server/atlas.management.test.ts:69`, test name `requires reviewer access to moderate comments`. Expected a TRPC error with `{ code: "FORBIDDEN" }`, but received `TRPCError` with `code: "INTERNAL_SERVER_ERROR"` and message beginning `Failed query: select \`id\`, \`us...`. This indicates the normal-user authorization check for `atlas.moderateComment` is occurring after or through a database query, or the procedure is not using the intended reviewer/admin middleware. `pnpm build` was not executed because test failed.

The PR branch is `repair/full-stack-clean-ci-fix`, base `repair/full-stack-clean`. Commits currently include `7653399` (`ci: use packageManager pnpm version`) and `782bba2` (`ci: run on repair branch pull requests`). The workflow now has `pull_request.branches: [main, repair/full-stack-clean]` so the PR receives CI.

GitHub Actions job annotations report:
- Expected: Object `{ code: "FORBIDDEN" }`
- Received: TRPCError `{ code: "INTERNAL_SERVER_ERROR" }`
- Location: `server/atlas.management.test.ts:69`
- Error text: `AssertionError: expected TRPCError: Failed query: select ... to match object { code: 'FORBIDDEN' }`

Relevant local test context:
```ts
it("requires reviewer access to moderate comments", async () => {
  await expect(appRouter.createCaller(context("user")).atlas.moderateComment({ id: 8, status: "approved" })).rejects.toMatchObject({ code: "FORBIDDEN" });
});
```

Relevant router import includes `updateAtlasComment`, `getAtlasComment`, and the atlas procedures. Need inspect exact `moderateComment` definition and middleware in the remote branch snapshot or local project, then make authorization run before DB access. After fixing, run `pnpm check`, `pnpm test`, and `pnpm build`, push to the PR branch, and verify a new GitHub Actions run succeeds.
