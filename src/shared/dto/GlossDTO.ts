import { GlossIdentifier } from "../LocalizedString";
import { Note } from "../Note";

export interface GlossReference extends GlossIdentifier {
    id: string;
}

export interface GlossDTO extends GlossReference {
    isParaphrased: boolean;
    transcriptions: string[];
    notes: Note[];

    contains: GlossReference[];
    nearSynonyms: GlossReference[];
    nearHomophones: GlossReference[];
    translations: GlossReference[];
    clarifiesUsage: GlossReference[];
    toBeDifferentiatedFrom: GlossReference[];
}
