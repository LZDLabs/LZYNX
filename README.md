# LZYNX

**Uma linguagem de programação simples, criada pela LZD Labs.**

Versão atual: **0.0.2** (experimental). Interpretador em TypeScript com CLI `lzn`.

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

## Recursos da versão 0.0.2
- Comando `say(...)` e variáveis.
- Números, textos e valores booleanos `true` / `false`.
- Aritmética: `+`, `-`, `*`, `/` e parênteses.
- Concatenação de texto com `+`.
- Comparações: `>`, `<`, `>=`, `<=`, `==`, `!=`.
- Condicionais `if/else` com blocos indentados.
- Comentários iniciados por `#`.
- Erros com linha e coluna.
- CLI: `lzn run`, `lzn --version`, `lzn --help`.

A linguagem continua experimental. Recursos como loops, funções, bibliotecas e compilação multiplataforma ainda serão desenvolvidos.

Made with 💜 by **LZD Labs**.
