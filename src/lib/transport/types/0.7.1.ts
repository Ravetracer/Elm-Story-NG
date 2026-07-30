/**
 * Transport types for the 0.7.1 storyworld schema.
 *
 * 0.7.1 changed nothing about the exported shape: upstream's own `types/0.7.1.ts`
 * and `schema/0.7.1.json` are byte-identical to the 0.7.0 pair, and its
 * `upgrade/0.7.1.ts` returns its input field for field. The release moved the
 * version string and nothing else.
 *
 * So this re-exports rather than forking 658 identical lines. That is not just
 * less code: these files are frozen descriptions of JSON already on disk, and two
 * separately declared string enums are not assignable to one another in
 * TypeScript even when their members have identical values. Sharing the one
 * declaration is what lets `upgrade/0.7.1.ts` pass a 0.7.0 value straight
 * through without a cast, and it means the two versions cannot drift apart while
 * claiming to describe the same bytes.
 *
 * A 0.7.2 that genuinely changes the shape gets its own file, copied from 0.7.0
 * at that point and frozen.
 */
export * from './0.7.0'
