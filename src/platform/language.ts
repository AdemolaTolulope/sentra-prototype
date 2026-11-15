/** Interface preference only. No translation is implied by selecting a language. */
export const LANGUAGES=[
 {code:'en',label:'English',speechTag:'en-NG'},
 {code:'yo',label:'Yoruba · Yorùbá',speechTag:'yo-NG'},
 {code:'ha',label:'Hausa',speechTag:'ha-NG'},
 {code:'ig',label:'Igbo',speechTag:'ig-NG'},
 {code:'pcm',label:'Nigerian Pidgin',speechTag:'pcm-NG'},
] as const;
export type LanguageCode=typeof LANGUAGES[number]['code'];
export const isLanguageCode=(value:unknown):value is LanguageCode=>LANGUAGES.some(item=>item.code===value);
