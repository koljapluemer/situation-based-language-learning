import { LocalizedString } from "../LocalizedString.js"
import { LanguageCode } from "../Language.js"

export interface SituationSummaryDTO {
    id: string
    descriptions: LocalizedString[]
    imageLink?: string
    targetLanguage: LanguageCode
    nativeLanguage: LanguageCode
    challengeCount: {
        expression: number
        understanding: number
    }
}
