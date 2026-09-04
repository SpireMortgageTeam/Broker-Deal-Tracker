// Shared Spire team roster — extracted from Insta Review (which needs the
// headshot crop settings) so Feature Sheets can also use it for the broker
// contact block. Phone numbers are confirmed by the team; email always
// follows the firstname@spiremortgage.ca convention, so it's derived rather
// than stored (one less thing to keep in sync).

export interface TeamMember {
  id: string;
  name: string;
  first: string;
  photo: string;
  pos: string;
  zoom: number;
  wide: string;
  phone: string; // "" if not yet on file
}

export const TEAM: TeamMember[] = [
  { id: "renee", name: "Renée Huse", first: "Renée", photo: "/insta-review/assets/team/renee-huse.png", pos: "50% 16%", zoom: 1.25, wide: "50% 22%", phone: "403-804-5465" },
  { id: "michael", name: "Michael", first: "Michael", photo: "/insta-review/assets/team/michael.jpg", pos: "50% 22%", zoom: 1.15, wide: "50% 26%", phone: "" },
  { id: "adam", name: "Adam King", first: "Adam", photo: "/insta-review/assets/team/adam-king.jpg", pos: "52% 12%", zoom: 2.0, wide: "50% 18%", phone: "403-703-1430" },
  { id: "natasha", name: "Natasha Rattai", first: "Natasha", photo: "/insta-review/assets/team/natasha-rattai.jpg", pos: "50% 18%", zoom: 1.12, wide: "50% 24%", phone: "403-993-8492" },
  { id: "paul", name: "Paul de Andrade", first: "Paul", photo: "/insta-review/assets/team/paul-de-andrade.jpg", pos: "50% 20%", zoom: 1.15, wide: "50% 26%", phone: "403-829-5043" },
  { id: "kristin", name: "Kristin", first: "Kristin", photo: "/insta-review/assets/team/kristin.jpg", pos: "50% 20%", zoom: 1.15, wide: "50% 26%", phone: "403-993-9710" },
  { id: "sherri", name: "Sherri Bureyko", first: "Sherri", photo: "/insta-review/assets/team/sherri-bureyko.jpg", pos: "56% 22%", zoom: 1.6, wide: "54% 28%", phone: "403-993-4742" },
  { id: "danielle", name: "Danielle Della Siega", first: "Danielle", photo: "/insta-review/assets/team/danielle-della-siega.jpg", pos: "50% 20%", zoom: 1.15, wide: "50% 26%", phone: "403-305-6505" },
  { id: "mukul", name: "Mukul", first: "Mukul", photo: "/insta-review/assets/team/mukul.jpg", pos: "50% 20%", zoom: 1.15, wide: "50% 26%", phone: "403-993-4126" },
  { id: "prashant", name: "Prashant Chudasama", first: "Prashant", photo: "/insta-review/assets/team/prashant-chudasama.jpg", pos: "50% 20%", zoom: 1.2, wide: "50% 26%", phone: "403-993-5077" },
];

export function teamEmail(m: TeamMember): string {
  return `${m.first.toLowerCase()}@spiremortgage.ca`;
}
