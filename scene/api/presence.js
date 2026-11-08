// /api/presence: who else is in the room right now (logic in ../server/presence.js).
//   POST    { tab, at } checks in and returns the other visitors; { tab, leave: true } checks out
import { beat } from '../server/presence.js'

export const POST = (req) => beat(req)
