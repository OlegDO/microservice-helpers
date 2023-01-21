declare module 'require-in-the-middle' {
  type TBCallback = (exports: any, name: string, basedir: string) => any;

  function Hook(modules: string[], callback: TBCallback): { unhook: CallableFunction };

  export default Hook;
}
