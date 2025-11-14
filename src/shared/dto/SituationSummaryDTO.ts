import { LocalizedString } from "../LocalizedString"
import { LanguageCode } from "../Language"

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
