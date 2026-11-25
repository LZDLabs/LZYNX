# LZYNX

**Uma linguagem de programação simples, criada pela LZD Labs.**

Versão atual: **0.0.3** (experimental). Interpretador em TypeScript com CLI `lzn`.

## Requisitos
- Node.js 20 ou superior
- npm

## Instalar ou atualizar
```bash
git clone https://github.com/LZDLabs/LZYNX.git
cd LZYNX
npm install
npm run build
npm link
```

Para atualizar uma cópia existente:
```bash
git pull --ff-only
npm install
npm run build
npm link
```

## Criar arquivos sem editor externo

```bash
create.file hello
```

O editor interativo abre no terminal. Digite o código e use:
- `:save` para salvar como `hello.lzn`.
- `:cancel` para sair sem salvar.
- Se o arquivo já existir, a LZYNX não sobrescreve.

## Executar
```bash
lzn run examples/hello.lzn
# ou
lzn examples/hello.lzn
```

## Exemplo com condições
```lzn
age = 20

if age >= 18:
    say("Maior de idade")
else:
    say("Menor de idade")
```

## Recursos da versão 0.0.3
- Comando `say(...)` e variáveis.
- Números, textos e valores booleanos `true` / `false`.
- Aritmética: `+`, `-`, `*`, `/` e parênteses.
- Concatenação de texto com `+`.
- Comparações: `>`, `<`, `>=`, `<=`, `==`, `!=`.
- Condicionais `if/else` com blocos indentados.
- Comentários iniciados por `#`.
- Erros com linha e coluna.
- Editor interativo: `create.file <nome>`, com salvamento em `.lzn`.
- CLI: `lzn run`, `lzn --version`, `lzn --help`.

A linguagem continua experimental. Recursos como loops, funções, bibliotecas e compilação multiplataforma ainda serão desenvolvidos.

Made with 💜 by **LZD Labs**.
