import { GlossDTO } from "./GlossDTO"
import { LocalizedString } from "../LocalizedString"
import { LanguageCode } from "../Language"

export interface SituationDTO {
    identifier: string
    descriptions: LocalizedString[]
    imageLink?: string
    targetLanguage: LanguageCode

    challengesOfUnderstandingText: GlossDTO[]
    challengesOfExpression: GlossDTO[]
}
