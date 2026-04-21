{ pkgs, ... }: {
  channel = "stable-23.11";
  packages = [
    pkgs.nodejs_20
    pkgs.jdk21
  ];
  idx = {
    extensions = [ ];
    previews = {
      enable = true;
      previews = {
        android = {
          command = [ "npx" "cap" "run" "android" "--" "-d" "emulator-5554" ];
          manager = "android";
        };
      };
    };
  };
}