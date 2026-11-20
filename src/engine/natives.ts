/**
 * Built-ins captured once at module load. Reading globals such as Math or Object
 * is very slow inside a sandboxed VM context (Jest runs tests in one), and these
 * run in the simulation's hot loops.
 */
export const { min, max, pow, floor, ceil, round, imul } = Math;
export const objectKeys = Object.keys;
export const objectValues = Object.values;
export const INFINITY = Number.POSITIVE_INFINITY;
