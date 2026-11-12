import {recordsSummary} from '../lib/blog.mjs';
export const GET=()=>Response.json(recordsSummary);
