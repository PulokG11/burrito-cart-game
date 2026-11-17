// Rooftop signs: a small stroke icon per building, picked from the pun in its name.
const G = {
  book: 'M4 5.5c2.5-1 5-1 8 1 3-2 5.5-2 8-1V19c-2.5-1-5-1-8 1-3-2-5.5-2-8-1z M12 6.5V20',
  bread: 'M5 12a7 5.5 0 0 1 14 0v6.5H5z M9 9.5l1 3 M12 8.8l1 3 M15 9.5l1 3',
  bed: 'M3 19V7 M3 14h18v5 M21 14v-2.5a2.5 2.5 0 0 0-2.5-2.5H11v5 M6.5 11.5h.01',
  tag: 'M3.5 12.5l8.5-8.5h8v8l-8.5 8.5z M16 8h.01',
  cross: 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z',
  scissors: 'M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M8.5 7.5L20 16 M8.5 16.5L20 8',
  fork: 'M7 3v7 M5 3v4a2 2 0 0 0 4 0V3 M7 10v11 M17 3c-2.5 2-2.5 7 0 8.5V21',
  wave: 'M3 10c3-3 6 3 9 0s6 3 9 0 M3 15c3-3 6 3 9 0s6 3 9 0 M3 20c3-3 6 3 9 0s6 3 9 0',
  frame: 'M4 4h16v16H4z M4 16l5-5 4 4 2.5-2.5L20 17 M15 8.5h.01',
  boot: 'M7 3h5v9l6.5 2.5c1 .4 1.5 1.3 1.5 2.3V20H7z M7 16h13',
  cards: 'M4 7h9.5v13H4z M9 4h10v13h-5.5',
  joystick: 'M12 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z M12 8.5v6 M4.5 14.5h15v5h-15z M8 17h.01',
  wrench: 'M14.5 6.5a4 4 0 0 0-5.3 5.3L3.5 17.5l3 3 5.7-5.7a4 4 0 0 0 5.3-5.3l-2.5 2.5-3-3z',
  cup: 'M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 10h2a2 2 0 0 1 0 4h-2 M8 3v2 M12 3v2',
  boat: 'M3 15h18l-3 5H6z M12 3v12 M12 4l6 8h-6',
  film: 'M4 5h16v14H4z M8 5v14 M16 5v14 M4 9h4 M4 15h4 M16 9h4 M16 15h4',
  apple: 'M12 7c-3-2-7 0-7 5s3 8 5 8c1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-3 5-8s-4-7-7-5z M12 7c0-2 1-3 3-4',
  flats: 'M6 3h12v18H6z M9 7h2 M13 7h2 M9 11h2 M13 11h2 M9 15h2 M13 15h2',
  hall: 'M3 9l9-5 9 5 M5 9v9 M10 9v9 M14 9v9 M19 9v9 M3 20h18',
  barn: 'M3 11l9-7 9 7v9H3z M9 20v-6h6v6',
  vase: 'M9 3h6 M10 3c0 3-4 4-4 9s3 9 6 9 6-4 6-9-4-6-4-9',
  pizza: 'M12 3L3 19c6 3 12 3 18 0z M9 13h.01 M13 15h.01 M12 9.5h.01',
  dumbbell: 'M4 9v6 M7 7v10 M17 7v10 M20 9v6 M7 12h10',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z',
  tree: 'M12 3l6 8h-3l4 6H5l4-6H6z M12 17v4',
  dice: 'M4 4h16v16H4z M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01',
}

const RULES: [RegExp, keyof typeof G][] = [
  [/Books|Library/, 'book'], [/Bakery/, 'bread'], [/Hostel|Apartments/, 'bed'], [/Thrift|Newsstand/, 'tag'],
  [/Hospital|Pharmacy/, 'cross'], [/Salon|Barbers/, 'scissors'], [/Pizza/, 'pizza'], [/Bistro|Diner/, 'fork'],
  [/Waterpark/, 'wave'], [/Shipyard/, 'boat'], [/Gallery/, 'frame'], [/Boots|Ski/, 'boot'], [/Bridge Club/, 'cards'],
  [/Arcade/, 'joystick'], [/Casino/, 'dice'], [/Hardware|Forge|Woodshop|Depot/, 'wrench'],
  [/Cafe|Coffee|Brewery/, 'cup'], [/Cinema/, 'film'], [/Elementary/, 'apple'], [/Pottery/, 'vase'],
  [/Barn|Ranch/, 'barn'], [/Garden|Forest|Lodge/, 'tree'], [/Gym|Yoga|Rec Center/, 'dumbbell'],
  [/Magic|Stadium/, 'star'], [/Hall|Plaza|Station/, 'hall'],
]

export function glyphFor(name: string): string {
  for (const [re, key] of RULES) if (re.test(name)) return G[key]
  return G.flats
}

export const TINTS = ['#F4A6B7', '#7CD3C8', '#F6DC6B', '#BBA9E6']
