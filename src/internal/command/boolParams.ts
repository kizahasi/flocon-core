import {
    AstInfo,
    beginCast,
    FFunction,
    FObject,
    FValue,
    OnGettingParams,
    ScriptError,
} from '@kizahasi/flocon-script';
import { recordToArray } from '@kizahasi/util';
import * as Character from '../ot/room/participant/character/types';
import * as BoolParam from '../ot/room/participant/character/boolParam/types';
import * as Room from '../ot/room/types';
import { FBoolParam } from './boolParam';

const createDefaultState = (): BoolParam.State => ({
    $v: 1,
    $r: 1,
    value: false,
    isValuePrivate: false,
});

export class FBoolParams extends FObject {
    public constructor(
        private readonly boolParams: Character.State['boolParams'],
        private readonly room: Room.State
    ) {
        super();
    }

    private findKeysByNameOrKey(nameOrKey: string | number) {
        return recordToArray(this.room.numParamNames)
            .filter(({ value }, i) => value.name === nameOrKey || i + 1 === nameOrKey)
            .map(({ key }) => key);
    }

    private findByNameOrKey(nameOrKeyValue: FValue, astInfo: AstInfo | undefined) {
        const nameOrKey = beginCast(nameOrKeyValue, astInfo).addString().addNumber().cast();
        const keys = this.findKeysByNameOrKey(nameOrKey);
        for (const key of keys) {
            const found = this.boolParams[key];
            if (found == null) {
                const newValue = createDefaultState();
                this.boolParams[key] = newValue;
                return newValue;
            }
            return found;
        }
        return undefined;
    }

    private toggleValue(nameOrKeyValue: FValue, astInfo: AstInfo | undefined) {
        const found = this.findByNameOrKey(nameOrKeyValue, astInfo);
        if (found == null) {
            return;
        }
        found.value = !(found.value ?? createDefaultState().value);
    }

    private setIsValuePrivate(
        nameOrKeyValue: FValue,
        newValue: FValue,
        astInfo: AstInfo | undefined
    ) {
        const $newValue = beginCast(newValue, astInfo).addBoolean().cast();
        const found = this.findByNameOrKey(nameOrKeyValue, astInfo);
        if (found == null) {
            return;
        }
        found.isValuePrivate = $newValue;
    }

    override getCore({ key, astInfo }: OnGettingParams): FValue {
        const keyAsString = key.toString();
        switch (keyAsString) {
            case 'find':
                return new FFunction(({ args }) => {
                    const result = this.findByNameOrKey(args[0], astInfo);
                    if (result == null) {
                        return undefined;
                    }
                    return new FBoolParam(result);
                });
            case 'toggleValue':
                return new FFunction(({ args }) => {
                    this.toggleValue(args[0], astInfo);
                    return undefined;
                });
            case 'setValue':
                return new FFunction(({ args }) => {
                    const newValue = beginCast(args[1], astInfo).addBoolean().cast();
                    const found = this.findByNameOrKey(args[0], astInfo);
                    if (found == null) {
                        return;
                    }
                    found.value = newValue;
                    return undefined;
                });
            case 'setIsValueSecret':
                return new FFunction(({ args }) => {
                    this.setIsValuePrivate(args[0], args[1], astInfo);
                    return undefined;
                });
            default:
                break;
        }
        return undefined;
    }

    override setCore(): void {
        throw new ScriptError('?????????????????????????????????????????????');
    }

    override toJObject(): unknown {
        return this.boolParams;
    }
}
