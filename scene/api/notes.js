// /api/notes: the guestbook (logic and setup notes in ../server/guestbook.js).
//   GET     the latest notes
//   POST    { name, text, color } pins a new note
//   DELETE  ?id=…  with an x-admin-key header removes one
import { list, post, remove } from '../server/guestbook.js'

export const GET = () => list()
export const POST = (req) => post(req)
export const DELETE = (req) => remove(req)
