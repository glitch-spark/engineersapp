import type { ContactItem, StyleConfig } from './resumeStyles';

const DEFAULT_CONTACT_ITEMS: ContactItem[] = [
  { type: 'email', enabled: true },
  { type: 'phone', enabled: true },
  { type: 'address', enabled: true },
  { type: 'github', enabled: false },
  { type: 'linkedin', enabled: false },
  { type: 'website', enabled: false },
  { type: 'twitter', enabled: false },
];

const black = '#000000';
const purple = '#341b74';

export const TEMPLATE_CLASSIC: StyleConfig = {
  page: { format: 'A4', margin: { top: 35, right: 30, bottom: 30, left: 30 } },
  sectionOrder: ['summary', 'experience', 'skills', 'education'],
  sectionSpacing: { containerMb: 8, headingMb: 4, dividerMb: 6 },

  basicInfo: {
    name: { fontFamily: 'Arial Black', fontSize: 20, fontWeight: 'bold', color: black, align: 'center' },
    title: { fontFamily: 'Arial Black', fontSize: 12, fontWeight: 'bold', color: black, align: 'center', text: 'Senior Software Engineer' },
    contact: { fontFamily: 'Tahoma', fontSize: 11, fontWeight: 'normal', color: black, align: 'center', separator: '|', items: DEFAULT_CONTACT_ITEMS },
  },
  sectionHeading: { fontFamily: 'Arial Black', fontSize: 11, fontWeight: 'bold', color: black, align: 'center' },
  summary: { fontFamily: 'Tahoma', fontSize: 11, fontWeight: 'normal', color: black, align: 'justify', boldLabels: true },
  experience: {
    companyName: { fontFamily: 'Arial Black', fontSize: 11, fontWeight: 'bold', color: purple },
    role: { fontFamily: 'Tahoma', fontSize: 11, fontWeight: 'normal', color: black },
    period: { fontFamily: 'Tahoma', fontSize: 11, fontWeight: 'normal', color: black, format: 'YYYY/MM - YYYY/MM' },
    separator: '|',
    bullet: { fontFamily: 'Tahoma', fontSize: 11, fontWeight: 'normal', color: black, align: 'justify', indentPx: 10, boldKeywords: true },
  },
  skills: { fontFamily: 'Tahoma', fontSize: 11, fontWeight: 'normal', color: black, align: 'justify', boldCategories: true, layout: 'one-per-line' },
  education: {
    university: { fontFamily: 'Arial Black', fontSize: 11, fontWeight: 'bold', color: purple },
    degree: { fontFamily: 'Tahoma', fontSize: 11, fontWeight: 'normal', color: black },
    period: { fontFamily: 'Tahoma', fontSize: 11, fontWeight: 'normal', color: black, format: 'YYYY - YYYY' },
    separator: '|',
  },
};

export const TEMPLATE_COMPACT: StyleConfig = {
  ...TEMPLATE_CLASSIC,
  page: { format: 'A4', margin: { top: 25, right: 22, bottom: 22, left: 22 } },
  sectionSpacing: { containerMb: 5, headingMb: 3, dividerMb: 4 },
  basicInfo: {
    ...TEMPLATE_CLASSIC.basicInfo,
    name: { ...TEMPLATE_CLASSIC.basicInfo.name, fontSize: 17 },
    title: { ...TEMPLATE_CLASSIC.basicInfo.title, fontSize: 11 },
    contact: { ...TEMPLATE_CLASSIC.basicInfo.contact, fontSize: 10 },
  },
  sectionHeading: { ...TEMPLATE_CLASSIC.sectionHeading, fontSize: 10 },
  summary: { ...TEMPLATE_CLASSIC.summary, fontSize: 10 },
  experience: {
    ...TEMPLATE_CLASSIC.experience,
    bullet: { ...TEMPLATE_CLASSIC.experience.bullet, fontSize: 10, indentPx: 8 },
  },
};

export const TEMPLATE_MODERN: StyleConfig = {
  ...TEMPLATE_CLASSIC,
  basicInfo: {
    ...TEMPLATE_CLASSIC.basicInfo,
    name: { ...TEMPLATE_CLASSIC.basicInfo.name, fontFamily: 'Helvetica', align: 'left' },
    title: { ...TEMPLATE_CLASSIC.basicInfo.title, fontFamily: 'Helvetica', align: 'left' },
    contact: { ...TEMPLATE_CLASSIC.basicInfo.contact, fontFamily: 'Helvetica', align: 'left' },
  },
  sectionHeading: { ...TEMPLATE_CLASSIC.sectionHeading, fontFamily: 'Helvetica', color: purple, align: 'left' },
  summary: { ...TEMPLATE_CLASSIC.summary, fontFamily: 'Helvetica' },
  experience: {
    ...TEMPLATE_CLASSIC.experience,
    companyName: { ...TEMPLATE_CLASSIC.experience.companyName, fontFamily: 'Helvetica' },
    role: { ...TEMPLATE_CLASSIC.experience.role, fontFamily: 'Helvetica' },
    period: { ...TEMPLATE_CLASSIC.experience.period, fontFamily: 'Helvetica' },
    bullet: { ...TEMPLATE_CLASSIC.experience.bullet, fontFamily: 'Helvetica' },
  },
  skills: { ...TEMPLATE_CLASSIC.skills, fontFamily: 'Helvetica' },
  education: {
    ...TEMPLATE_CLASSIC.education,
    university: { ...TEMPLATE_CLASSIC.education.university, fontFamily: 'Helvetica' },
    degree: { ...TEMPLATE_CLASSIC.education.degree, fontFamily: 'Helvetica' },
    period: { ...TEMPLATE_CLASSIC.education.period, fontFamily: 'Helvetica' },
  },
};

export const TEMPLATES = {
  classic: { label: 'Classic', config: TEMPLATE_CLASSIC },
  compact: { label: 'Compact', config: TEMPLATE_COMPACT },
  modern: { label: 'Modern', config: TEMPLATE_MODERN },
};

export type TemplateKey = keyof typeof TEMPLATES;
