// Phones and tablets get a lighter version of the room: the same scene and every animation, but cheaper lights,
// no hover tracking (there's no hover on touch) and fewer pixels. `?lite` forces it on a desktop for testing.
export const touch = window.matchMedia('(pointer: coarse)').matches
export const lite = touch || new URLSearchParams(location.search).has('lite')
