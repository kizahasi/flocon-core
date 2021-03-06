import {
    AstInfo,
    beginCast,
    FBoolean,
    FFunction,
    FObject,
    FString,
    FValue,
    OnGettingParams,
    ScriptError,
} from '@kizahasi/flocon-script';
import { isStrIndex20 } from '../indexes';
import * as ParamName from '../ot/room/paramName/types';
import * as Room from '../ot/room/types';

export class FParamNames extends FObject {
    public constructor(
        private readonly room: Room.State,
        private readonly mode: 'Boolean' | 'Number' | 'String'
    ) {
        super();
    }

    private getParamNames() {
        switch (this.mode) {
            case 'Boolean':
                return this.room.boolParamNames;
            case 'Number':
                return this.room.numParamNames;
            case 'String':
                return this.room.strParamNames;
        }
    }

    private find(key: FValue, astInfo: AstInfo | undefined) {
        const keyAsString = beginCast(key, astInfo).addNumber().cast().toString();
        if (!isStrIndex20(keyAsString)) {
            return undefined;
        }
        return this.getParamNames()[keyAsString];
    }

    private ensure(key: FValue, astInfo: AstInfo | undefined) {
        const keyAsString = beginCast(key, astInfo).addNumber().cast().toString();
        if (!isStrIndex20(keyAsString)) {
            return undefined;
        }
        const found = this.getParamNames()[keyAsString];
        if (found != null) {
            return found;
        }
        const result: ParamName.State = {
            $v: 1,
            $r: 1,
            name: '',
        };
        this.getParamNames()[keyAsString] = result;
        return result;
    }

    private delete(key: FValue, astInfo: AstInfo | undefined) {
        const keyAsString = beginCast(key, astInfo).addNumber().cast().toString();
        if (!isStrIndex20(keyAsString)) {
            return false;
        }
        const found = this.getParamNames()[keyAsString];
        if (found == null) {
            return false;
        }
        this.getParamNames()[keyAsString] = undefined;
        return true;
    }

    override getCore({ key, astInfo }: OnGettingParams): FValue {
        const keyAsString = key.toString();
        switch (keyAsString) {
            case 'getName':
                return new FFunction(({ args }) => {
                    const result = this.find(args[0], astInfo);
                    if (result == null) {
                        return undefined;
                    }
                    return new FString(result.name);
                });
            case 'setName':
                return new FFunction(({ args }) => {
                    const result = this.ensure(args[0], astInfo);
                    const newName = beginCast(args[1], astInfo).addString().cast();
                    if (result == null) {
                        return undefined;
                    }
                    result.name = newName;
                    return undefined;
                });
            case 'delete':
                return new FFunction(({ args }) => {
                    return new FBoolean(this.delete(args[0], astInfo));
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
        return this.getParamNames();
    }
}
