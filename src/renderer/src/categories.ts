// TPB / apibay categories. Numeric ids are stable across the API surface.

export interface CategoryGroup {
  group: string
  cats: Array<{ id: number; label: string }>
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    group: 'Video',
    cats: [
      { id: 200, label: 'All Video' },
      { id: 201, label: 'Movies' },
      { id: 207, label: 'HD — Movies' },
      { id: 211, label: 'UHD / 4K — Movies' },
      { id: 202, label: 'Movies DVDR' },
      { id: 209, label: '3D' },
      { id: 210, label: 'CAM / TS' },
      { id: 205, label: 'TV shows' },
      { id: 208, label: 'HD — TV shows' },
      { id: 212, label: 'UHD / 4K — TV shows' },
      { id: 203, label: 'Music videos' },
      { id: 204, label: 'Movie clips' },
      { id: 206, label: 'Handheld' },
      { id: 299, label: 'Video — Other' }
    ]
  },
  {
    group: 'Audio',
    cats: [
      { id: 100, label: 'All Audio' },
      { id: 101, label: 'Music' },
      { id: 104, label: 'FLAC' },
      { id: 102, label: 'Audio books' },
      { id: 103, label: 'Sound clips' },
      { id: 199, label: 'Audio — Other' }
    ]
  },
  {
    group: 'Applications',
    cats: [
      { id: 300, label: 'All Applications' },
      { id: 301, label: 'Windows' },
      { id: 302, label: 'Mac' },
      { id: 303, label: 'UNIX' },
      { id: 304, label: 'Handheld' },
      { id: 305, label: 'iOS (iPad / iPhone)' },
      { id: 306, label: 'Android' },
      { id: 399, label: 'Other OS' }
    ]
  },
  {
    group: 'Games',
    cats: [
      { id: 400, label: 'All Games' },
      { id: 401, label: 'PC' },
      { id: 402, label: 'Mac' },
      { id: 403, label: 'PSx' },
      { id: 404, label: 'XBOX360' },
      { id: 405, label: 'Wii' },
      { id: 406, label: 'Handheld' },
      { id: 407, label: 'iOS (iPad / iPhone)' },
      { id: 408, label: 'Android' },
      { id: 499, label: 'Games — Other' }
    ]
  },
  {
    group: 'Porn',
    cats: [
      { id: 500, label: 'All Porn' },
      { id: 501, label: 'Movies' },
      { id: 505, label: 'HD — Movies' },
      { id: 507, label: 'UHD / 4K — Movies' },
      { id: 502, label: 'Movies DVDR' },
      { id: 506, label: 'Movie clips' },
      { id: 503, label: 'Pictures' },
      { id: 504, label: 'Games' },
      { id: 599, label: 'Porn — Other' }
    ]
  },
  {
    group: 'Other',
    cats: [
      { id: 600, label: 'All Other' },
      { id: 601, label: 'E-books' },
      { id: 602, label: 'Comics' },
      { id: 603, label: 'Pictures' },
      { id: 604, label: 'Covers' },
      { id: 605, label: 'Physibles' },
      { id: 699, label: 'Other — Other' }
    ]
  }
]
