// (不正な|悪意のある)キーが混入するおそれがあるのはserverTransformのときのみなので、serverTransform以外では使わなくてよい
export const isValidKey = (key: string): boolean => {
    if (key.length >= 11) {
        return false;
    }
    return key.match(/^([0-9a-zA-Z]|-|_)+$/g) != null;
};
