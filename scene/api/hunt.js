// /api/hunt: the puzzle hunt's hall of solvers (logic in ../server/hunt.js).
//   GET     the solvers so far, first first
//   POST    { answer, name } signs the hall
import { list, post } from '../server/hunt.js'

export const GET = () => list()
export const POST = (req) => post(req)
