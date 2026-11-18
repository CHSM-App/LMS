// Body for PUT /teacher/courses/:id, built from a course as the API returns it.
export const toVideoInput = (v) => (v ? (v.source === 'upload' ? { source: 'upload', fileKey: v.fileKey } : { source: v.source, url: v.url }) : null);

export function toCourseInput(c) {
  return {
    title: c.title,
    subject: c.subject,
    language: c.language,
    description: c.description,
    durationText: c.durationText || null,
    feeDisplay: c.feeDisplay || null,
    thumbnailKey: c.thumbnailKey || null,
    demoVideo1: toVideoInput(c.demoVideo1),
    demoVideo2: toVideoInput(c.demoVideo2),
  };
}
