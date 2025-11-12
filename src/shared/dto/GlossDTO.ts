import { GlossIdentifier } from "../LocalizedString";
import { Note } from "../Note";

export interface GlossDTO extends GlossIdentifier {
    id: string;
    isParaphrased: boolean;
    transcriptions: string[];
    notes: Note[];

    contains: GlossIdentifier[];
    nearSynonyms: GlossIdentifier[];
    nearHomophones: GlossIdentifier[];
    translations: GlossIdentifier[];
    clarifiesUsage: GlossIdentifier[];
    toBeDifferentiatedFrom: GlossIdentifier[];
}
