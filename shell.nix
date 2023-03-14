let
  pkgs = import <nixpkgs> { };
in 
with pkgs;
mkShell {
  name = "mailmentor-dev-env";
  buildInputs = [ 
    nodejs-16_x
    yarn
  ];
}
