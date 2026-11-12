import {records} from '../lib/blog.mjs';
export const GET=()=>Response.json(records);
