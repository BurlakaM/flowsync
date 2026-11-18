# Changelog

## [0.2.0](https://github.com/BurlakaM/flowsync/compare/v0.1.0...v0.2.0) (2026-11-18)


### Features

* **api:** add a request id to logs, responses and error bodies ([4f7139f](https://github.com/BurlakaM/flowsync/commit/4f7139f205aec8c356c142acc95f1c9d0ffd41b4))
* **auth,users:** move registration to /auth/register, add /auth/me, profile updates and the admin user list ([6c7edc2](https://github.com/BurlakaM/flowsync/commit/6c7edc248aa1f51b842a434287d16fabd102ebe2))
* **auth:** add rotating refresh tokens in an httpOnly cookie ([81d6eca](https://github.com/BurlakaM/flowsync/commit/81d6eca6a993be5564f1d0ec83337f9421ffc34a))
* **auth:** add sign-up with automatic sign-in ([7099cda](https://github.com/BurlakaM/flowsync/commit/7099cdae6e47c44bf6f19a7afff413c20c564517))
* **backend:** add config validation, global guards, error filters, health, Swagger and test infrastructure ([3751b81](https://github.com/BurlakaM/flowsync/commit/3751b8104ec5e0e4d0ff8f1e119176a2c8f5c0d3))
* **backend:** add search, CASL permissions, domain events, notifications, real-time and project pictures ([b240ad4](https://github.com/BurlakaM/flowsync/commit/b240ad42e1bdbbbbca4e7f90040b5691cc22ce96))
* **comments,tags:** add task comments and project tags, wire all modules into the app ([ee042c5](https://github.com/BurlakaM/flowsync/commit/ee042c5f8bb2f20b38f568f091db04938308e488))
* **comments:** add the comment thread of a task ([2e76484](https://github.com/BurlakaM/flowsync/commit/2e76484433cb71e6d036015e6919d42ef824611b))
* **db:** migrate from MySQL to PostgreSQL and seed default roles ([7cff376](https://github.com/BurlakaM/flowsync/commit/7cff3764fb54da1bc2929758fbc97b6d9ace7b3e))
* **db:** rewrite the Prisma schema, add the init migration and a demo seed ([e581653](https://github.com/BurlakaM/flowsync/commit/e581653c68f9f884b34705fb2ff33f5444dfd1c9))
* **docker:** split compose into dev and prod, add nginx proxy and env examples ([66911c4](https://github.com/BurlakaM/flowsync/commit/66911c4e5401e180176c1ea83c6d286068ccfa3f))
* **frontend:** add project and task pages and compose the features ([095d6cd](https://github.com/BurlakaM/flowsync/commit/095d6cd9c17e19c5b5c3058ebb3bbc1a3b53ef64))
* **frontend:** add shared layout, state, form and dialog components ([9bb5d45](https://github.com/BurlakaM/flowsync/commit/9bb5d45303c5b1928083111476f1e2149f9a6b30))
* **frontend:** add the app foundation with login and protected routes ([7fdd4eb](https://github.com/BurlakaM/flowsync/commit/7fdd4ebaefdbf60702af8b4779a6af5a57b93276))
* **frontend:** add the board, activity, notifications, live updates, project pictures and Ukrainian ([6b8f0a9](https://github.com/BurlakaM/flowsync/commit/6b8f0a97927d4a3b46f8ab3fa0e571f0515cdeee))
* **frontend:** generate API types from openapi.json ([f60e5ef](https://github.com/BurlakaM/flowsync/commit/f60e5ef83de192054a35d259c4322e9d549de4b8))
* **frontend:** keep the access token in memory and restore sessions with the refresh cookie ([d8e220d](https://github.com/BurlakaM/flowsync/commit/d8e220d48abb4b7c9bc994251fa4407b6acf7d95))
* **frontend:** redesign the UI as Aurora with light and dark themes ([ab38585](https://github.com/BurlakaM/flowsync/commit/ab3858505332f153daadae46678e1090cf55014c))
* **nginx:** add a content security policy and fix asset caching ([6f69c90](https://github.com/BurlakaM/flowsync/commit/6f69c90ff0819e41cb1d25033e289a7600f1525f))
* **observability:** add metrics, tracing, error reporting, dashboards and SLOs ([186d2ea](https://github.com/BurlakaM/flowsync/commit/186d2eaad1a8ad4f5d68ff8d52509b83fe515cb1))
* **ops:** add health probes, backup with restore check, smoke test and rollback deploy ([0cd1396](https://github.com/BurlakaM/flowsync/commit/0cd1396f054112a72fa7990ddd0eca3fffbb837d))
* **projects:** add projects and members with owner/member access ([bd91f74](https://github.com/BurlakaM/flowsync/commit/bd91f744fa3a412ee347a7036e3aa99f8acca72a))
* **projects:** add projects, members and their forms ([b739a81](https://github.com/BurlakaM/flowsync/commit/b739a81339861e5f8ead6440c56cd726b2b3defc))
* **reliability:** add transactional outbox, task versions, cursor pagination and socket scaling ([2e5695f](https://github.com/BurlakaM/flowsync/commit/2e5695fbc09f6d81bbc530ebe42189710b81b392))
* **security:** add password reset, email verification, account lock, Prisma 7 and security scans ([b8e3737](https://github.com/BurlakaM/flowsync/commit/b8e373741a1cbb00e8a7925d45035c06ea7bbff3))
* **tasks:** add nested task routes with filters, sorting, assignees and tags ([dcfe06f](https://github.com/BurlakaM/flowsync/commit/dcfe06f1123335e088331db78c1c9744b277d857))
* **tasks:** add task list, filters, form and tags ([1220592](https://github.com/BurlakaM/flowsync/commit/122059239bc190c4641aed8c94d2e4021b954802))


### Bug Fixes

* **ci:** read the Playwright version from the lockfile in the visual script ([21079f9](https://github.com/BurlakaM/flowsync/commit/21079f91318fad6a5f858a6d3da55acd6ae891d6))
* **docker:** make backend and frontend images build and run ([62d2c3c](https://github.com/BurlakaM/flowsync/commit/62d2c3c116ba66d1ee17a4c0d2f598acaebeebb6))
* **frontend:** make the image upload test pass on Node 24 and the slow tests less flaky ([8c9a566](https://github.com/BurlakaM/flowsync/commit/8c9a56684398c0cbe004bc13a9d85cc6ff0d1002))
* **security:** close critical API vulnerabilities (plan phase 0) ([6d15019](https://github.com/BurlakaM/flowsync/commit/6d15019879a64cf0b05c6521dbe731381e4af963))


### Performance Improvements

* **api:** count rows per page, split the search into indexed branches, add quality tooling ([80b950a](https://github.com/BurlakaM/flowsync/commit/80b950aa400bf2ddc06cfcd40d125aaf808e35f5))

## Changelog

Усі помітні зміни FlowSync. Файл веде release-please з Conventional Commits: вручну його не редагують
(див. `CONTRIBUTING.md`, розділ «Релізи»). Історія до першого релізу — у `docs/ARCHITECTURE_PLAN.md` (журнал прогресу).
